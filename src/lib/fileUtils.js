import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export const saveFile = async (blob, fileName, mimeType) => {
  if (Capacitor.isNativePlatform()) {
    try {
      // Convert blob to base64
      const base64Data = await blobToBase64(blob);

      // Save file using Capacitor Filesystem
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
      });

      console.log(`File saved to Documents/${fileName}`);
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  } else {
    // Browser download (though this is mobile app, keeping for compatibility)
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
};

const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result;
      // Remove data URL prefix (e.g., "data:application/pdf;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
