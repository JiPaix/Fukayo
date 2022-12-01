export type ChapterImage = {
  /** 0 based index of the page */
  index: number,
  /**
   * Base64 data string of the page image
   * @example "data:image/png;base64,..."
   */
  src: string,
  /**
   * Weither this page is the last one
   */
  lastpage: boolean
  /**
   * height
   */
  height: number,
  /**
   * width
   */
  width: number
}
