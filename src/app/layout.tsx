import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "ParcelFlow · Delivery workspace", template: "%s · ParcelFlow" },
  description: "Next.js foundation for parcel delivery management and tracking.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
