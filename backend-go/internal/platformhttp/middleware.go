package platformhttp

import (
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"vendorhub/internal/httpx"
)

func Chain(handler http.Handler, frontendURL string, logger *slog.Logger) http.Handler {
	return recoverer(cors(handler, frontendURL), logger)
}

func cors(next http.Handler, frontendURL string) http.Handler {
	allowed := strings.TrimRight(frontendURL, "/")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimRight(r.Header.Get("Origin"), "/")
		if origin != "" && (origin == allowed || strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:")) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, If-None-Match")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func recoverer(next http.Handler, logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		defer func() {
			if value := recover(); value != nil {
				logger.Error("panic khi xử lý request", "method", r.Method, "path", r.URL.Path,
					"panic", fmt.Sprint(value), "stack", string(debug.Stack()))
				httpx.JSON(w, http.StatusInternalServerError, httpx.Message{Message: "Server Error"})
			}
			logger.Info("request", "method", r.Method, "path", r.URL.Path, "duration", time.Since(started))
		}()
		next.ServeHTTP(w, r)
	})
}
