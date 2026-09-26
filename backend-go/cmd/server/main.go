package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"vendorhub/internal/app"
	"vendorhub/internal/config"
	"vendorhub/internal/database"
	"vendorhub/internal/media"
	"vendorhub/internal/notificationmail"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		logger.Error("cấu hình không hợp lệ", "error", err)
		os.Exit(1)
	}

	rootCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	db, err := database.Open(rootCtx, cfg)
	if err != nil {
		logger.Error("không mở được database", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	mediaStorage, err := media.New(rootCtx, media.Config{
		Disk: cfg.MediaDisk, Root: cfg.MediaRoot, AccessKey: cfg.AWSAccessKeyID,
		SecretKey: cfg.AWSSecretAccessKey, Region: cfg.AWSRegion, Bucket: cfg.AWSBucket,
		PublicURL: cfg.AWSURL, Endpoint: cfg.AWSEndpoint, UsePathStyle: cfg.AWSUsePathStyle,
	})
	if err != nil {
		logger.Error("không khởi tạo được media storage", "error", err)
		os.Exit(1)
	}
	mailWorker := notificationmail.New(db, notificationmail.Config{
		Enabled: cfg.MailMailer == "smtp", Scheme: cfg.MailScheme, Host: cfg.MailHost,
		Port: cfg.MailPort, Username: cfg.MailUsername, Password: cfg.MailPassword,
		FromAddress: cfg.MailFromAddress, FromName: cfg.MailFromName,
		FrontendURL: cfg.FrontendURL, HourlyCap: cfg.MailHourlyCap,
	}, logger)
	go mailWorker.Run(rootCtx)

	server := &http.Server{
		Addr: cfg.HTTPAddr, Handler: app.App{DB: db, Config: cfg, Logger: logger, Media: mediaStorage}.Handler(),
		ReadTimeout: cfg.ReadTimeout, WriteTimeout: cfg.WriteTimeout, IdleTimeout: cfg.IdleTimeout,
	}
	go func() {
		logger.Info("VendorHub Go đang lắng nghe", "addr", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("HTTP server dừng bất thường", "error", err)
			stop()
		}
	}()

	<-rootCtx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown thất bại", "error", err)
	}
}
