FROM ladder99/relay:0.11.7 AS upstream

# The upstream OS is Debian 11 with retired package archives. Reuse the
# unchanged application and dependencies in a supported Debian 12 runtime.
FROM node:22-bookworm-slim

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*
COPY --from=upstream /usr/app /usr/app
COPY requirements.txt /opt/kfgyr/requirements.txt
RUN python3 -m venv /opt/kfgyr/venv \
    && /opt/kfgyr/venv/bin/pip install --no-cache-dir -r /opt/kfgyr/requirements.txt \
    && mkdir -p /run/kfgyr-relay /var/lib/kfgyr-monitoring \
    && chown 1000:0 /run/kfgyr-relay /var/lib/kfgyr-monitoring \
    && chmod 2770 /run/kfgyr-relay /var/lib/kfgyr-monitoring
COPY runner.py server.py configuration.py discovery.py /opt/kfgyr/
WORKDIR /usr/app
ENV KFGYR_CONFIG_DIR=/var/lib/kfgyr-monitoring \
    KFGYR_RELAY_RUNTIME_DIR=/run/kfgyr-relay \
    KFGYR_RELAY_STARTUP_SECONDS=10 \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/kfgyr/venv/bin:$PATH
USER 1000:0
EXPOSE 8091
STOPSIGNAL SIGTERM
ENTRYPOINT ["python3", "/opt/kfgyr/server.py"]
HEALTHCHECK --interval=15s --timeout=4s --start-period=40s --retries=3 CMD ["python3", "/opt/kfgyr/server.py", "--healthcheck"]
