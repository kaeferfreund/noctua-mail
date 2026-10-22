declare module "nodemailer" {
  export function createTransport(options: any): {
    verify(): Promise<boolean>;
    close(): void;
    sendMail(message: any): Promise<void>;
  };
}

// The address parser has no Node dependencies and is shared with browser consumers.
declare module "nodemailer/lib/addressparser/index.js" {
  export default function addressParser(value: string, options: { flatten: true }): Array<{ address: string; name: string }>;
}
