
import "./globals.css";

export const metadata = {
  title: "HDH Patient Data Creation",
  description: "A tool for creating patient data records",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
