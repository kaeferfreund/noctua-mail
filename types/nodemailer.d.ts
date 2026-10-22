declare module "nodemailer" {
  export function createTransport(options: any): {
    verify(): Promise<boolean>;
    close(): void;
    sendMail(message: any): Promise<void>;
  };
}

declare module "nodemailer/lib/addressparser/index.js" {
  export default function addressParser(
    value: string,
    options: { flatten: true }
  ): { address: string; name: string }[];
}
