import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface WidgetQRCodeProps {
  url: string;
  size?: number;
  className?: string;
}

const WidgetQRCode = ({ url, size = 64, className = "" }: WidgetQRCodeProps) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: size * 2,
      margin: 1,
      color: { dark: "#1a1a1a", light: "#ffffff" },
    }).then(setDataUrl);
  }, [url, size]);

  if (!dataUrl) return null;

  return (
    <div className={`bg-white rounded-lg p-1 shadow-sm ${className}`}>
      <img src={dataUrl} alt="QR Code" width={size} height={size} className="block" />
    </div>
  );
};

export default WidgetQRCode;
