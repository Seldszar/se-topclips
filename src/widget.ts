import { app, h, text } from "hyperapp";
import ky from "ky";

declare global {
  interface WindowEventMap {
    onWidgetLoad: CustomEvent;
  }
}

interface State {
  topClips: any[];
}

const dispatch = app<State>({
  node: document.body.appendChild(document.createElement("div")),
  init: {
    topClips: [],
  },
  view: ({ topClips }) =>
    h(
      "div",
      {
        class: "topClips",
      },
      topClips.map((clip) =>
        h(
          "div",
          {
            class: "topClip",
          },
          [
            h(
              "div",
              {
                class: "creatorName",
              },
              text(clip.creator_name)
            ),
            h(
              "div",
              {
                class: "viewCount",
              },
              text(`${clip.view_count} view${clip.view_count === 1 ? "" : "s"}`)
            ),
          ]
        )
      )
    ),
});

const getPeriodDuration = (value: string): number => {
  switch (value) {
    case "day":
      return 86400000;

    case "week":
      return 604800000;

    case "month":
      return 2592000000;

    default:
      return 0;
  }
};

const createClient = (clientId: string, clientSecret: string) => {
  const fetchAccessToken = async () => {
    const data = await ky
      .post("https://id.twitch.tv/oauth2/token", {
        searchParams: {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
        },
      })
      .json<any>();

    return data.access_token;
  };

  const fetchClips = async (accessToken: string, userId: string, period: string, first: number) => {
    const startedAt = new Date(Date.now() - getPeriodDuration(period));
    const searchParams = new URLSearchParams({
      broadcaster_id: userId,
      started_at: startedAt.toISOString(),
      first: first.toString(),
    });

    const { data } = await ky
      .get("https://api.twitch.tv/helix/clips", {
        searchParams,
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      })
      .json<any>();

    return data;
  };

  return { fetchAccessToken, fetchClips };
};

let timeoutHandle: number;

window.addEventListener("onWidgetLoad", async (event): Promise<void> => {
  const {
    detail: {
      channel: { providerId },
      fieldData: { clientId, clientSecret, count, period },
    },
  } = event;

  const client = createClient(clientId, clientSecret);

  const refresh = async () => {
    if (timeoutHandle) {
      window.clearTimeout(timeoutHandle);
    }

    try {
      const accessToken = await client.fetchAccessToken();
      const topClips = await client.fetchClips(accessToken, providerId, period, count);

      dispatch({ topClips });
    } catch {} // eslint-disable-line no-empty

    timeoutHandle = window.setTimeout(refresh, 60000);
  };

  refresh();
});
