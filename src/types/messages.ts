export type TAnnouncementObject = {
  name: string;
  data: { [key: string]: any };
  interval: number;
  available: boolean;
  eventName?: string;
};

export type TRsInfoObject = {
  address?: string;
};
