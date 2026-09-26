package authn

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"vendorhub/internal/httpx"
)

type Handler struct {
	store  *Store
	cipher *LaravelCipher
}

func NewHandler(store *Store, appKey []byte) *Handler {
	h := &Handler{store: store}
	if len(appKey) == 32 {
		h.cipher, _ = NewLaravelCipher(appKey)
	}
	return h
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		httpx.JSON(w, http.StatusBadRequest, httpx.Message{Message: "Dữ liệu JSON không hợp lệ"})
		return false
	}
	return true
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var input struct{ Email, Password string }
	if !decodeJSON(w, r, &input) {
		return
	}
	v := httpx.NewValidation()
	if strings.TrimSpace(input.Email) == "" {
		v.Add("email", "The email field is required.")
	}
	if input.Password == "" {
		v.Add("password", "The password field is required.")
	}
	if v.Failed() {
		httpx.WriteValidationFailed(w, v)
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	accounts, err := h.store.ActiveAccountsByEmail(r.Context(), email)
	if err != nil {
		serverError(w)
		return
	}
	if len(accounts) == 0 {
		httpx.JSON(w, http.StatusUnauthorized, httpx.Message{Message: "Email không tồn tại"})
		return
	}
	matched := make([]User, 0, len(accounts))
	for _, u := range accounts {
		if u.Password != nil && bcrypt.CompareHashAndPassword([]byte(*u.Password), []byte(input.Password)) == nil {
			matched = append(matched, u)
		}
	}
	if len(matched) == 0 {
		httpx.JSON(w, http.StatusUnauthorized, httpx.Message{Message: "Mật khẩu sai"})
		return
	}

	roles := map[string]struct{}{}
	for _, u := range matched {
		roles[u.Role] = struct{}{}
	}
	if len(roles) > 1 {
		if h.cipher == nil {
			httpx.JSON(w, http.StatusServiceUnavailable, httpx.Message{Message: "APP_KEY chưa được cấu hình"})
			return
		}
		raw, _ := json.Marshal(map[string]any{"email": email, "exp": time.Now().Unix() + 600})
		ticket, err := h.cipher.EncryptString(raw)
		if err != nil {
			serverError(w)
			return
		}
		summaries := make([]AccountSummary, len(matched))
		for i := range matched {
			summaries[i] = matched[i].Summary()
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"needs_selection": true, "ticket": ticket, "accounts": summaries})
		return
	}
	h.loginSuccess(w, r, matched[0], "auth_token")
}

func (h *Handler) SelectAccount(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Ticket    string `json:"ticket"`
		AccountID any    `json:"account_id"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	v := httpx.NewValidation()
	if input.Ticket == "" {
		v.Add("ticket", "The ticket field is required.")
	}
	accountID, ok := integer(input.AccountID)
	if !ok {
		v.Add("account_id", "The account id field is required.")
	}
	if v.Failed() {
		httpx.WriteValidationFailed(w, v)
		return
	}
	if h.cipher == nil {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Phiên chọn tài khoản không hợp lệ"})
		return
	}
	raw, err := h.cipher.DecryptString(input.Ticket)
	if err != nil {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Phiên chọn tài khoản không hợp lệ"})
		return
	}
	var ticket struct {
		Email string `json:"email"`
		Exp   int64  `json:"exp"`
	}
	if json.Unmarshal(raw, &ticket) != nil || ticket.Email == "" || ticket.Exp < time.Now().Unix() {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Phiên đã hết hạn, vui lòng đăng nhập lại"})
		return
	}
	u, err := h.store.ActiveUserForSelection(r.Context(), accountID, ticket.Email)
	if errors.Is(err, sql.ErrNoRows) {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Tài khoản không hợp lệ hoặc đã bị khoá"})
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	h.loginSuccess(w, r, u, "auth_token")
}

func integer(value any) (int64, bool) {
	switch v := value.(type) {
	case float64:
		return int64(v), v > 0 && v == float64(int64(v))
	case string:
		n, err := strconv.ParseInt(v, 10, 64)
		return n, err == nil && n > 0
	default:
		return 0, false
	}
}

func (h *Handler) loginSuccess(w http.ResponseWriter, r *http.Request, u User, tokenName string) {
	token, err := h.store.CreateToken(r.Context(), u.ID, tokenName)
	if err != nil {
		serverError(w)
		return
	}
	projects, err := h.store.ProjectsFor(r.Context(), u)
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"message": "Login success", "token": token, "user": u.Payload(projects)})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	p, _ := PrincipalFrom(r.Context())
	projects, err := h.store.ProjectsFor(r.Context(), p.User)
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"user": p.User.Payload(projects)})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	p, _ := PrincipalFrom(r.Context())
	if err := h.store.DeleteToken(r.Context(), p.TokenID, p.User.ID); err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.Message{Message: "Logout success"})
}

func serverError(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusInternalServerError, httpx.Message{Message: "Server Error"})
}
