export function chapterLabel(number:number, name?:string) {
  if(name) return `${number} - ${name}`;
  return number;
}
