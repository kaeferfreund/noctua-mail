// Minimal Bun runtime declarations, alongside bun-sqlite.d.ts.
declare module "bun:ffi" {
  export enum FFIType { i32 = 5 }
  export function dlopen(path:string,symbols:{flock:{args:[FFIType.i32,FFIType.i32];returns:FFIType.i32}}): {
    symbols:{flock:(fd:number,operation:number)=>number};
    close:()=>void;
  };
}
