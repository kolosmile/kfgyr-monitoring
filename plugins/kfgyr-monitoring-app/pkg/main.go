package main

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/kolosmile/kfgyr-monitoring/plugins/kfgyr-monitoring-app/pkg/plugin"
	"os"
)

func main() {
	if err := app.Manage("kfgyr-monitoring-app", plugin.New, app.ManageOpts{}); err != nil {
		log.DefaultLogger.Error("plugin stopped", "error", err)
		os.Exit(1)
	}
}
