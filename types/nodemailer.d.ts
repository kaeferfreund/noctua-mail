declare module "nodemailer" {
  export function createTransport(options: any): {
    verify(): Promise<boolean>;
    close(): void;
    sendMail(message: any): Promise<void>;
  };
}
