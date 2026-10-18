FROM ladder99/relay:0.11.7 AS upstream

# The upstream OS is Debian 11 with retired package archives. Reuse the
# unchanged application and dependencies in a supported Debian 12 runtime.
FROM node:22-bookworm-slim

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=upstream /usr/app /usr/app
COPY runner.py /opt/kfgyr/runner.py
WORKDIR /usr/app
ENV KFGYR_CONFIG_DIR=/var/lib/kfgyr-monitoring \
    KFGYR_RELAY_RUNTIME_DIR=/run/kfgyr-relay \
    KFGYR_RELAY_STARTUP_SECONDS=10 \
    PYTHONUNBUFFERED=1
STOPSIGNAL SIGTERM
ENTRYPOINT ["python3", "/opt/kfgyr/runner.py"]
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=3 CMD ["python3", "/opt/kfgyr/runner.py", "--healthcheck"]
