declare module "docxtemplater-image-module-free" {
  interface ImageModuleOptions {
    centered?: boolean;
    getImage: (tagValue: string, tagName: string) => Buffer | Uint8Array;
    getSize: (
      img: Buffer | Uint8Array,
      tagValue: string,
      tagName: string
    ) => [number, number];
  }

  class ImageModule {
    constructor(opts: ImageModuleOptions);
  }

  export = ImageModule;
}
