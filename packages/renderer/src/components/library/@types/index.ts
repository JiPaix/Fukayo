export type MangaInDBwithLabel = {
  mirror: string,
  lang:string,
  name: string,
  displayName?: string,
  url: string,
  unread: number,
  chapters: {
    label: string | number;
    value: number;
    read:boolean
  }[]
};

export type MangaGroup = {
  name: string;
  mangas: MangaInDBwithLabel[];
  covers: string[];
  unread:number;
};
