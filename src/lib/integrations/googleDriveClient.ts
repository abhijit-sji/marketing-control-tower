import { google } from "googleapis";

export const getGoogleDriveClient = () => {
  const oauth2Client = new google.auth.OAuth2(
    import.meta.env.VITE_GOOGLE_CLIENT_ID,
    import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    refresh_token: import.meta.env.VITE_GOOGLE_REFRESH_TOKEN,
  });
  return google.drive({ version: "v3", auth: oauth2Client });
};

export type GoogleDriveClient = ReturnType<typeof getGoogleDriveClient>;
