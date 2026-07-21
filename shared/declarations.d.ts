declare module 'opentype.js' {
  export function load(
    url: string,
    callback: (err: Error | null, font: any) => void,
  ): void;

  export function parse(buffer: ArrayBuffer): any;

  const opentype: {
    load: typeof load;
    parse: typeof parse;
  };

  export default opentype;
}