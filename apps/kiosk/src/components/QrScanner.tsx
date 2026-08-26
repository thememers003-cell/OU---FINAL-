import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Loader2, Camera, AlertTriangle } from 'lucide-react';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: any) => void;
}

export default function QrScanner({ onScanSuccess, onScanFailure }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const scannerId = 'qr-reader';

    const startScanner = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          if (isMounted) setHasPermission(true);
          
          scannerRef.current = new Html5Qrcode(scannerId);
          await scannerRef.current.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
            },
            (decodedText) => {
              if (isMounted) onScanSuccess(decodedText);
            },
            (errorMessage) => {
              if (isMounted && onScanFailure) onScanFailure(errorMessage);
            }
          );
          if (isMounted) setIsScanning(true);
        } else {
          if (isMounted) {
            setHasPermission(false);
            setError('No camera found on this device.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setHasPermission(false);
          setError(err.message || 'Camera permission denied or unavailable.');
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScanSuccess, onScanFailure]);

  if (hasPermission === false || error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-dark-800 rounded-2xl border border-dark-700 text-center">
        <AlertTriangle className="w-12 h-12 text-accent-amber mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Camera Unavailable</h3>
        <p className="text-dark-400 mb-6">{error}</p>
        <p className="text-sm text-dark-500">Please use the Print Code method instead.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-2xl border-4 border-dark-700 shadow-2xl bg-black">
      {!isScanning && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900 z-10">
          <Loader2 className="w-8 h-8 text-xpos-500 animate-spin mb-2" />
          <p className="text-dark-400 text-sm">Initializing camera...</p>
        </div>
      )}
      <div id="qr-reader" className="w-full h-full" />
      
      {/* Target Overlay */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40 z-20">
          <div className="w-full h-full border-2 border-xpos-500 rounded-lg relative">
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-xpos-500 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-xpos-500 rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-xpos-500 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-xpos-500 rounded-br-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
