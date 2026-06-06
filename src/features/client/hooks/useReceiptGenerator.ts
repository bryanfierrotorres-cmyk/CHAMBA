import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildReceiptHtml } from '@features/client/utils/receiptHtml';
import type { ReceiptData } from '@features/client/utils/receiptTypes';

export const useReceiptGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const downloadReceipt = useCallback(async (data: ReceiptData) => {
    setIsGenerating(true);
    try {
      const html = buildReceiptHtml(data);
      const { uri } = await Print.printToFileAsync({
        html,
        width: 595,
        height: 842,
      });

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          const link = document.createElement('a');
          link.href = uri;
          link.download = `CHAMBA-recibo-${data.jobId.slice(0, 8)}.pdf`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Guardar recibo CHAMBA',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo generar el recibo';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Recibo', message);
      }
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { downloadReceipt, isGenerating };
};
