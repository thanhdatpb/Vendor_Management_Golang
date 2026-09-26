// Package app lắp các module HTTP. Trong giai đoạn chuyển tiếp, chỉ route đã
// được đăng ký ở đây mới được reverse proxy sang Go; các route còn lại vẫn ở PHP.
package app

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	"vendorhub/internal/authn"
	"vendorhub/internal/config"
	"vendorhub/internal/httpx"
	"vendorhub/internal/libraryapi"
	"vendorhub/internal/media"
	"vendorhub/internal/newsapi"
	"vendorhub/internal/notificationapi"
	"vendorhub/internal/platformhttp"
	"vendorhub/internal/pricesheetapi"
	"vendorhub/internal/productapi"
	"vendorhub/internal/realtime"
	"vendorhub/internal/userapi"
	"vendorhub/internal/vendorapi"
)

type App struct {
	DB     *sql.DB
	Config config.Config
	Logger *slog.Logger
	Media  media.Storage
}

func (a App) Handler() http.Handler {
	mux := http.NewServeMux()
	stream := realtime.New(a.Config.PusherAppID, a.Config.PusherAppKey, a.Config.PusherAppSecret, a.Config.PusherCluster, a.Logger)
	notificationapi.ConfigurePublisher(stream)
	mediaStorage := a.Media
	if mediaStorage == nil {
		mediaStorage = media.Local{Root: a.Config.MediaRoot}
	}
	authStore := authn.NewStore(a.DB)
	authHandler := authn.NewHandler(authStore, a.Config.AppKey)
	oauthHandler := authn.NewOAuthHandler(authStore, authn.OAuthConfig{
		ClientID: a.Config.GoogleClientID, ClientSecret: a.Config.GoogleClientSecret,
		RedirectURI: a.Config.GoogleRedirectURI, FrontendURL: a.Config.FrontendURL,
		AppKey: a.Config.AppKey, Production: a.Config.Environment == "production",
	})
	libraryHandler := libraryapi.NewHandler(libraryapi.NewStore(a.DB)).WithMediaRoot(a.Config.MediaRoot).WithStorage(mediaStorage).WithPublisher(stream)
	priceSheetHandler := pricesheetapi.NewHandler(a.DB).WithPublisher(stream)
	notificationHandler := notificationapi.NewHandler(a.DB)
	newsHandler := newsapi.NewHandler(a.DB)
	userHandler := userapi.NewHandler(a.DB, a.Logger)
	vendorHandler := vendorapi.NewHandler(a.DB).WithMediaRoot(a.Config.MediaRoot).WithStorage(mediaStorage).WithExtractScript(a.Config.VendorExtractScript)
	productHandler := productapi.NewHandler(a.DB, a.Config.MediaRoot).WithStorage(mediaStorage).WithPublisher(stream)

	mux.HandleFunc("GET /up", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "vendorhub-go"})
	})
	mux.HandleFunc("GET /health/live", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /health/ready", a.ready)

	mux.HandleFunc("POST /api/login", authHandler.Login)
	mux.HandleFunc("GET /api/login", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusUnauthorized, httpx.Message{Message: "Unauthenticated. Please provide a valid token."})
	})
	mux.HandleFunc("POST /api/select-account", authHandler.SelectAccount)
	mux.HandleFunc("GET /api/auth/google/redirect", oauthHandler.Redirect)
	mux.HandleFunc("GET /api/auth/google/callback", oauthHandler.Callback)
	mux.HandleFunc("GET /api/analytics/conversion", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]float64{"conversion_rate": 3.2})
	})
	mux.HandleFunc("GET /api/analytics/profit", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]int{"profit": 15000})
	})
	mux.Handle("GET /api/me", authStore.Require(http.HandlerFunc(authHandler.Me)))
	mux.Handle("POST /api/logout", authStore.Require(http.HandlerFunc(authHandler.Logout)))

	// Vendor Library: mọi role đăng nhập được đọc; chỉ Vendor/Staff B được ghi.
	mux.Handle("GET /api/vendor-library", authStore.Require(http.HandlerFunc(libraryHandler.Get)))
	mux.Handle("GET /api/vendor-library/index", authStore.Require(http.HandlerFunc(libraryHandler.Index)))
	mux.Handle("GET /api/vendor-library/files", authStore.Require(http.HandlerFunc(libraryHandler.ListFiles)))
	mux.Handle("GET /api/vendor-library/files/by-name/{filename...}", authStore.Require(http.HandlerFunc(libraryHandler.ShowFileByName)))
	mux.Handle("GET /api/vendor-library/files/{id}", authStore.Require(http.HandlerFunc(libraryHandler.ShowFile)))

	vendorOnly := authn.RequireRoles("staff_b", "vendor")
	mux.Handle("POST /api/vendor-library", authStore.Require(vendorOnly(http.HandlerFunc(libraryHandler.Save))))
	mux.Handle("POST /api/vendor-library/sample-status", authStore.Require(vendorOnly(http.HandlerFunc(libraryHandler.UpdateSampleStatus))))
	mux.Handle("POST /api/vendor-library/best-seller", authStore.Require(vendorOnly(http.HandlerFunc(libraryHandler.UpdateBestSeller))))
	mux.Handle("POST /api/vendor-library/restore-backup", authStore.Require(vendorOnly(http.HandlerFunc(libraryHandler.Restore))))
	mux.Handle("POST /api/vendor-library/upload-images", authStore.Require(vendorOnly(http.HandlerFunc(libraryHandler.UploadImages))))
	mux.Handle("GET /api/vendor-library/images/{filename}", authStore.Require(http.HandlerFunc(libraryHandler.Image)))

	mux.Handle("GET /api/price-sheets", authStore.Require(http.HandlerFunc(priceSheetHandler.Index)))
	mux.Handle("GET /api/price-sheets/{id}/versions", authStore.Require(http.HandlerFunc(priceSheetHandler.Versions)))
	mux.Handle("GET /api/price-sheets/{id}", authStore.Require(http.HandlerFunc(priceSheetHandler.Show)))
	mux.Handle("POST /api/price-sheets", authStore.Require(http.HandlerFunc(priceSheetHandler.Upsert)))
	mux.Handle("DELETE /api/price-sheets/{id}", authStore.Require(http.HandlerFunc(priceSheetHandler.Destroy)))

	mux.Handle("GET /api/notifications", authStore.Require(http.HandlerFunc(notificationHandler.Index)))
	mux.Handle("POST /api/notifications/read-all", authStore.Require(http.HandlerFunc(notificationHandler.ReadAll)))
	mux.Handle("POST /api/notifications/{id}/read", authStore.Require(http.HandlerFunc(notificationHandler.ReadOne)))

	mux.Handle("GET /api/news", authStore.Require(http.HandlerFunc(newsHandler.Index)))
	mux.Handle("POST /api/news", authStore.Require(vendorOnly(http.HandlerFunc(newsHandler.Store))))
	mux.Handle("PUT /api/news/{id}", authStore.Require(vendorOnly(http.HandlerFunc(newsHandler.Update))))
	mux.Handle("DELETE /api/news/{id}", authStore.Require(vendorOnly(http.HandlerFunc(newsHandler.Destroy))))
	mux.Handle("POST /api/news/{id}/send", authStore.Require(vendorOnly(http.HandlerFunc(newsHandler.Send))))

	mux.Handle("GET /api/users", authStore.Require(http.HandlerFunc(userHandler.Users)))
	mux.Handle("GET /api/users/sellers", authStore.Require(http.HandlerFunc(userHandler.Sellers)))
	mux.Handle("GET /api/users/{id}", authStore.Require(http.HandlerFunc(userHandler.Show)))
	mux.Handle("GET /api/admin/users", authStore.Require(authn.RequireAdmin(http.HandlerFunc(userHandler.AdminIndex))))
	mux.Handle("POST /api/admin/users", authStore.Require(authn.RequireAdmin(http.HandlerFunc(userHandler.Create))))
	mux.Handle("PATCH /api/admin/users/{id}", authStore.Require(authn.RequireAdmin(http.HandlerFunc(userHandler.Update))))
	mux.Handle("PATCH /api/admin/users/{id}/status", authStore.Require(authn.RequireAdmin(http.HandlerFunc(userHandler.ToggleStatus))))

	mux.Handle("GET /api/vendors/compare", authStore.Require(http.HandlerFunc(vendorHandler.Compare)))
	mux.Handle("GET /api/vendors", authStore.Require(http.HandlerFunc(vendorHandler.Index)))
	mux.Handle("POST /api/vendors/import", authStore.Require(http.HandlerFunc(vendorHandler.Import)))
	mux.Handle("POST /api/vendors", authStore.Require(http.HandlerFunc(vendorHandler.Store)))
	mux.Handle("GET /api/vendors/{id}", authStore.Require(http.HandlerFunc(vendorHandler.Show)))
	mux.Handle("PUT /api/vendors/{id}", authStore.Require(http.HandlerFunc(vendorHandler.Update)))
	mux.Handle("DELETE /api/vendors/truncate", authStore.Require(http.HandlerFunc(vendorHandler.Truncate)))
	mux.Handle("DELETE /api/vendors/{id}", authStore.Require(http.HandlerFunc(vendorHandler.Destroy)))
	mux.Handle("POST /api/vendors/{id}/upload-media", authStore.Require(http.HandlerFunc(vendorHandler.UploadMedia)))
	mux.Handle("DELETE /api/vendors/{id}/delete-media", authStore.Require(http.HandlerFunc(vendorHandler.DeleteMedia)))
	mux.HandleFunc("GET /api/vendors/media", vendorHandler.LegacyMedia)
	mux.Handle("POST /api/admin/products/{id}/select-vendor", authStore.Require(authn.RequireAdmin(http.HandlerFunc(vendorHandler.Select))))

	// Product workflow. The approved feed remains public to match the Laravel API.
	mux.HandleFunc("GET /api/products-approved", productHandler.Approved)
	mux.Handle("GET /api/products", authStore.Require(http.HandlerFunc(productHandler.Index)))
	mux.Handle("POST /api/products", authStore.Require(http.HandlerFunc(productHandler.Store)))
	mux.Handle("GET /api/products/{id}", authStore.Require(http.HandlerFunc(productHandler.Show)))
	mux.Handle("PUT /api/products/{id}", authStore.Require(http.HandlerFunc(productHandler.Update)))
	mux.Handle("POST /api/products/{id}", authStore.Require(http.HandlerFunc(productHandler.Update)))
	mux.Handle("DELETE /api/products/{id}", authStore.Require(http.HandlerFunc(productHandler.Destroy)))
	mux.Handle("POST /api/products/{id}/submit", authStore.Require(http.HandlerFunc(productHandler.Submit)))
	mux.Handle("POST /api/products/{id}/feedback", authStore.Require(http.HandlerFunc(productHandler.Feedback)))
	mux.Handle("PUT /api/products/{id}/deadline", authStore.Require(http.HandlerFunc(productHandler.Deadline)))
	mux.Handle("POST /api/products/{id}/assign-vendors", authStore.Require(vendorOnly(http.HandlerFunc(productHandler.AssignVendors))))
	mux.Handle("GET /api/admin/product-approvals", authStore.Require(authn.RequireAdmin(http.HandlerFunc(productHandler.Pending))))
	mux.Handle("GET /api/admin/products/stats", authStore.Require(authn.RequireAdmin(http.HandlerFunc(productHandler.Stats))))
	mux.Handle("POST /api/admin/products/{id}/approve", authStore.Require(authn.RequireAdmin(http.HandlerFunc(productHandler.Approve))))
	mux.Handle("POST /api/admin/products/{id}/reject", authStore.Require(authn.RequireAdmin(http.HandlerFunc(productHandler.Reject))))
	mux.Handle("GET /api/admin/products/{id}/vendor-comparison", authStore.Require(authn.RequireAdmin(http.HandlerFunc(productHandler.VendorComparison))))

	logger := a.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return platformhttp.Chain(mux, a.Config.FrontendURL, logger)
}

func (a App) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), time.Second)
	defer cancel()
	if err := a.DB.PingContext(ctx); err != nil {
		httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ready"})
}
