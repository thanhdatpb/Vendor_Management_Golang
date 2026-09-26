package authn

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"vendorhub/internal/httpx"
)

type contextKey uint8

const principalKey contextKey = 1

type Principal struct {
	User    User
	TokenID int64
}

func PrincipalFrom(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(principalKey).(Principal)
	return p, ok
}

// ContextWithPrincipal chủ yếu dùng bởi contract test của các module phía sau
// auth middleware. Request production luôn đi qua Store.Require.
func ContextWithPrincipal(ctx context.Context, principal Principal) context.Context {
	return context.WithValue(ctx, principalKey, principal)
}

func (s *Store) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := strings.TrimSpace(r.Header.Get("Authorization"))
		if len(header) < 8 || !strings.EqualFold(header[:7], "Bearer ") {
			httpx.Unauthenticated(w)
			return
		}
		u, tokenID, err := s.Authenticate(r.Context(), strings.TrimSpace(header[7:]))
		if errors.Is(err, ErrUnauthenticated) {
			httpx.Unauthenticated(w)
			return
		}
		if err != nil {
			httpx.JSON(w, http.StatusInternalServerError, httpx.Message{Message: "Server Error"})
			return
		}
		ctx := context.WithValue(r.Context(), principalKey, Principal{User: u, TokenID: tokenID})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, ok := PrincipalFrom(r.Context())
		if !ok || !p.User.IsAdmin() {
			httpx.AdminForbidden(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func RequireRoles(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p, ok := PrincipalFrom(r.Context())
			if !ok || !p.User.HasRole(roles...) {
				httpx.RoleForbidden(w)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
