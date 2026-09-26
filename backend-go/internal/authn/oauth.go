package authn

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	googleAuthorizeURL = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL     = "https://oauth2.googleapis.com/token"
	googleUserInfoURL  = "https://openidconnect.googleapis.com/v1/userinfo"
	oauthStateCookie   = "vendorhub_oauth_state"
)

type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	FrontendURL  string
	AppKey       []byte
	Production   bool
	HTTPClient   *http.Client
	TokenURL     string
	UserInfoURL  string
}

type OAuthHandler struct {
	store  *Store
	config OAuthConfig
}

func NewOAuthHandler(store *Store, config OAuthConfig) *OAuthHandler {
	if config.HTTPClient == nil {
		config.HTTPClient = &http.Client{Timeout: 15 * time.Second}
	}
	if config.TokenURL == "" {
		config.TokenURL = googleTokenURL
	}
	if config.UserInfoURL == "" {
		config.UserInfoURL = googleUserInfoURL
	}
	return &OAuthHandler{store: store, config: config}
}

func (h *OAuthHandler) Redirect(w http.ResponseWriter, r *http.Request) {
	if !h.configured() {
		h.failure(w, r, "oauth_failed")
		return
	}
	stateBytes := make([]byte, 32)
	if _, err := rand.Read(stateBytes); err != nil {
		h.failure(w, r, "oauth_failed")
		return
	}
	state := base64.RawURLEncoding.EncodeToString(stateBytes)
	http.SetCookie(w, &http.Cookie{
		Name: oauthStateCookie, Value: state, Path: "/api/auth/google/callback",
		HttpOnly: true, Secure: h.config.Production || r.TLS != nil,
		SameSite: http.SameSiteLaxMode, MaxAge: 600,
	})
	query := url.Values{
		"client_id": {h.config.ClientID}, "redirect_uri": {h.config.RedirectURI},
		"response_type": {"code"}, "scope": {"openid email profile"},
		"state": {state}, "prompt": {"select_account"},
	}
	http.Redirect(w, r, googleAuthorizeURL+"?"+query.Encode(), http.StatusFound)
}

func (h *OAuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	if !h.configured() {
		h.failure(w, r, "oauth_failed")
		return
	}
	cookie, err := r.Cookie(oauthStateCookie)
	state := r.URL.Query().Get("state")
	if err != nil || state == "" || len(cookie.Value) != len(state) || subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(state)) != 1 {
		h.failure(w, r, "oauth_failed")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: oauthStateCookie, Value: "", Path: "/api/auth/google/callback", MaxAge: -1, HttpOnly: true, Secure: h.config.Production || r.TLS != nil, SameSite: http.SameSiteLaxMode})
	code := r.URL.Query().Get("code")
	if code == "" || r.URL.Query().Get("error") != "" {
		h.failure(w, r, "oauth_failed")
		return
	}
	accessToken, err := h.exchange(r.Context(), code)
	if err != nil {
		h.failure(w, r, "oauth_failed")
		return
	}
	profile, err := h.profile(r.Context(), accessToken)
	if err != nil {
		h.failure(w, r, "oauth_failed")
		return
	}
	if !profile.EmailVerified {
		h.failure(w, r, "email_not_verified")
		return
	}
	accounts, err := h.oauthAccounts(r.Context(), strings.ToLower(strings.TrimSpace(profile.Email)))
	if err != nil {
		h.failure(w, r, "oauth_failed")
		return
	}
	if len(accounts) == 0 {
		h.failure(w, r, "account_not_found")
		return
	}
	active := make([]oauthAccount, 0, len(accounts))
	linkedID := ""
	for _, account := range accounts {
		if account.GoogleID == profile.Subject {
			linkedID = profile.Subject
		} else if linkedID == "" && account.GoogleID != "" {
			linkedID = account.GoogleID
		}
		if account.User.IsActive {
			active = append(active, account)
		}
	}
	if len(active) == 0 {
		h.failure(w, r, "account_disabled")
		return
	}
	if linkedID != "" && linkedID != profile.Subject {
		h.failure(w, r, "identity_mismatch")
		return
	}
	for _, account := range accounts {
		h.syncGoogleProfile(r.Context(), account, profile)
	}
	roles := map[string]bool{}
	for _, account := range active {
		roles[account.User.Role] = true
	}
	if len(active) == 1 || len(roles) == 1 {
		token, err := h.store.CreateToken(r.Context(), active[0].User.ID, "google_auth")
		if err != nil {
			h.failure(w, r, "oauth_failed")
			return
		}
		h.frontendRedirect(w, r, "/auth/callback", url.Values{"token": {token}})
		return
	}
	cipher, err := NewLaravelCipher(h.config.AppKey)
	if err != nil {
		h.failure(w, r, "oauth_failed")
		return
	}
	ticketPayload, _ := json.Marshal(map[string]any{"email": strings.ToLower(profile.Email), "exp": time.Now().Unix() + 600})
	ticket, err := cipher.EncryptString(ticketPayload)
	if err != nil {
		h.failure(w, r, "oauth_failed")
		return
	}
	summaries := make([]AccountSummary, 0, len(active))
	for _, account := range active {
		summaries = append(summaries, account.User.Summary())
	}
	rawSummaries, _ := json.Marshal(summaries)
	h.frontendRedirect(w, r, "/auth/callback", url.Values{
		"select": {ticket}, "accounts": {base64.StdEncoding.EncodeToString(rawSummaries)},
	})
}

func (h *OAuthHandler) configured() bool {
	return h.config.ClientID != "" && h.config.ClientSecret != "" && h.config.RedirectURI != "" && h.config.FrontendURL != ""
}

func (h *OAuthHandler) exchange(ctx context.Context, code string) (string, error) {
	form := url.Values{
		"client_id": {h.config.ClientID}, "client_secret": {h.config.ClientSecret},
		"code": {code}, "grant_type": {"authorization_code"}, "redirect_uri": {h.config.RedirectURI},
	}
	request, _ := http.NewRequestWithContext(ctx, http.MethodPost, h.config.TokenURL, strings.NewReader(form.Encode()))
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := h.config.HTTPClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", errors.New("google token exchange failed")
	}
	var payload struct {
		AccessToken string `json:"access_token"`
	}
	err = json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&payload)
	if err != nil || payload.AccessToken == "" {
		return "", errors.New("google token response invalid")
	}
	return payload.AccessToken, nil
}

type googleProfile struct {
	Subject       string `json:"sub"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
}

func (h *OAuthHandler) profile(ctx context.Context, token string) (googleProfile, error) {
	request, _ := http.NewRequestWithContext(ctx, http.MethodGet, h.config.UserInfoURL, nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response, err := h.config.HTTPClient.Do(request)
	if err != nil {
		return googleProfile{}, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return googleProfile{}, errors.New("google userinfo failed")
	}
	var profile googleProfile
	err = json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&profile)
	if err != nil || profile.Subject == "" || profile.Email == "" {
		return googleProfile{}, errors.New("google profile invalid")
	}
	return profile, nil
}

type oauthAccount struct {
	User
	GoogleID string
}

func (h *OAuthHandler) oauthAccounts(ctx context.Context, email string) ([]oauthAccount, error) {
	rows, err := h.store.db.QueryContext(ctx, `SELECT `+userColumns+`,u.google_id FROM users u WHERE LOWER(u.email)=? ORDER BY u.id`, email)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	accounts := []oauthAccount{}
	for rows.Next() {
		var account oauthAccount
		var fullName, password, project, pdProjects, sellerName, avatarURL, googleID sql.NullString
		err := rows.Scan(&account.ID, &account.Name, &fullName, &account.Email, &password, &account.Role, &project, &pdProjects, &sellerName, &avatarURL, &account.IsActive, &googleID)
		if err != nil {
			return nil, err
		}
		account.FullName, account.Password, account.Project = nullString(fullName), nullString(password), nullString(project)
		if pdProjects.Valid {
			account.PDProjects = []byte(pdProjects.String)
		}
		account.SellerName, account.AvatarURL, account.GoogleID = nullString(sellerName), nullString(avatarURL), googleID.String
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}

func (h *OAuthHandler) syncGoogleProfile(ctx context.Context, account oauthAccount, profile googleProfile) {
	if account.GoogleID == "" {
		_, _ = h.store.db.ExecContext(ctx, `UPDATE users SET google_id=?,updated_at=? WHERE id=? AND (google_id IS NULL OR google_id='')`, profile.Subject, time.Now().UTC(), account.ID)
	}
	if profile.Picture != "" {
		_, _ = h.store.db.ExecContext(ctx, `UPDATE users SET avatar_url=?,updated_at=? WHERE id=?`, profile.Picture, time.Now().UTC(), account.ID)
	}
	if account.FullName == nil && profile.Name != "" {
		_, _ = h.store.db.ExecContext(ctx, `UPDATE users SET full_name=?,updated_at=? WHERE id=? AND (full_name IS NULL OR full_name='')`, profile.Name, time.Now().UTC(), account.ID)
	}
}

func (h *OAuthHandler) failure(w http.ResponseWriter, r *http.Request, code string) {
	h.frontendRedirect(w, r, "/login", url.Values{"error": {code}})
}

func (h *OAuthHandler) frontendRedirect(w http.ResponseWriter, r *http.Request, path string, query url.Values) {
	target := strings.TrimRight(h.config.FrontendURL, "/") + path
	if encoded := query.Encode(); encoded != "" {
		target += "?" + encoded
	}
	http.Redirect(w, r, target, http.StatusFound)
}
