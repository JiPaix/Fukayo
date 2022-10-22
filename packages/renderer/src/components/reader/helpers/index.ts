export function chapterLabel(number:number, name?:string) {
  if(name) return `${number} - ${name}`;
  return number;
}

export function isMouseEvent(event:KeyboardEvent|MouseEvent):event is MouseEvent {
  return typeof (event as KeyboardEvent).key === 'undefined';
}
