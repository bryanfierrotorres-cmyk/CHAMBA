import { useCallback, useRef, useState } from 'react';
import { Alert, Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { ReceiptData } from '@features/client/utils/receiptTypes';

export const useReceiptGenerator = () => {
  const receiptCaptureRef = useRef<View>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const downloadReceipt = useCallback(async (_data: ReceiptData) => {
    const target = receiptCaptureRef.current;
    if (!target) {
      Alert.alert('Recibo', 'No se pudo preparar el comprobante. Intentá de nuevo.');
      return;
    }

    setIsGenerating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, Platform.OS === 'web' ? 120 : 40));

      const filename = `CHAMBA-recibo-${_data.jobId.slice(0, 8)}.png`;
      const uri = await captureRef(target, {
        format: 'png',
        quality: 1,
        result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
      });

      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          const link = document.createElement('a');
          link.href = uri;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Guardar recibo CHAMBA',
          UTI: 'public.png',
        });
      } else {
        Alert.alert('Recibo', 'Imagen generada correctamente.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo generar la imagen';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Recibo', message);
      }
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { receiptCaptureRef, downloadReceipt, isGenerating };
};
