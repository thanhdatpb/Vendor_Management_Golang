// Package realtime isolates Pusher so business handlers can degrade to polling
// when realtime is disabled or temporarily unavailable.
package realtime

import (
	"log/slog"
	"net/http"
	"time"

	pusher "github.com/pusher/pusher-http-go/v5"
)

type Publisher interface {
	Trigger(channel, event string, data any)
}

type bestEffort struct {
	client *pusher.Client
	logger *slog.Logger
}

type noop struct{}

func (noop) Trigger(string, string, any) {}

func New(appID, key, secret, cluster string, logger *slog.Logger) Publisher {
	if appID == "" || key == "" || secret == "" {
		return noop{}
	}
	if logger == nil {
		logger = slog.Default()
	}
	client := &pusher.Client{
		AppID: appID, Key: key, Secret: secret, Cluster: cluster, Secure: true,
		HTTPClient: &http.Client{Timeout: 3 * time.Second},
	}
	return &bestEffort{client: client, logger: logger}
}

func (p *bestEffort) Trigger(channel, event string, data any) {
	if err := p.client.Trigger(channel, event, data); err != nil {
		p.logger.Warn("không phát được sự kiện realtime", "channel", channel, "event", event, "error", err)
	}
}
