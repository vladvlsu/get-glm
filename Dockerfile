# syntax=docker/dockerfile:1.7
ARG HOME=/app
ARG SCRIPT=./run_ui.sh
ARG CNAME=glm
ARG UID=1001
ARG GID=1001

FROM --platform=$BUILDPLATFORM node:26-bookworm-slim AS builder

ARG HOME
WORKDIR $HOME

SHELL [ "/bin/bash", "-exc" ]

COPY ./package.json ./package-lock.json $HOME/

ENV npm_config_cache=$HOME/.cache

RUN <<EOF
apt-get update --quiet
npm ci
npx playwright install --with-deps chromium
EOF

FROM --platform=$TARGETPLATFORM node:26-bookworm-slim AS final

ARG HOME
ARG SCRIPT
ARG CNAME
ARG UID
ARG GID

WORKDIR $HOME

STOPSIGNAL SIGTERM

SHELL [ "/bin/bash", "-exc" ]

RUN <<EOF
apt-get update --quiet
apt-get install -y --no-install-recommends socat && rm -rf /var/lib/apt/lists/*
EOF

RUN <<EOF
set -eux

if [[ "${UID}" -gt 0 ]] && id --name --user "${UID}" >/dev/null 2>&1; then
    deluser "$(id --name --user "${UID}")"
fi

if [[ "${GID}" -gt 0 ]]; then
    if id --name --group "${GID}" >/dev/null 2>&1; then
        groupdel "$(id --name --group "${GID}")"
    fi
    groupadd --gid "${GID}" "${CNAME}"
fi

if [[ "${UID}" -gt 0 ]]; then
    useradd --uid "${UID}" --gid "${GID}" --no-create-home --home-dir "${HOME}" "${CNAME}"
    mkdir -p /app /app/data /app/data/browser_profiles /app/logs /app/.cache/uv
    chown -R "${UID}:${GID}" "${HOME}"
fi
EOF

COPY --chown=$UID:$GID . $HOME

COPY --link --from=builder --chown=$UID:$GID $HOME/node_modules $HOME/node_modules

COPY --link --from=builder --chown=$UID:$GID $HOME/.cache/ms-playwright /home/$CNAME/.cache/ms-playwright

COPY --link --chown=$UID:$GID ./$SCRIPT $HOME/$SCRIPT

RUN chmod u+x $SCRIPT

USER $CNAME

ENTRYPOINT ["./run_ui.sh"]
