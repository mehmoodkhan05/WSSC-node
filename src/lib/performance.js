import apiClient from './apiClient';
import { PARSE_CLASSES } from './apiClient';
import * as FileSystem from 'expo-file-system/legacy';

// Upload performance review photos - returns base64 data URIs
export async function uploadPerformancePhotos(fileUris, staffId, date) {
  try {
    const paths = [];
    
    for (let i = 0; i < fileUris.length; i++) {
      const fileUri = fileUris[i];
      if (!fileUri) continue;

      // Read file as base64 using legacy API
      let encoding;
      if (FileSystem.EncodingType && FileSystem.EncodingType.Base64) {
        encoding = FileSystem.EncodingType.Base64;
      } else {
        encoding = 'base64';
      }
      
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: encoding,
      });

      // Create file name
      const fileName = `perf_${staffId}_${date}_${i + 1}_${Date.now()}.jpg`;

      // Return base64 data URI
      const dataUri = `data:image/jpeg;base64,${base64}`;
      paths.push(dataUri);
    }

    return { paths };
  } catch (error) {
    console.error('Error uploading performance photos:', error);
    throw error;
  }
}

// Fetch performance reviews
export async function fetchPerformanceReviews(filters = {}) {
  try {
    const response = await apiClient.get('/performance', {
      staffId: filters.staffId || undefined,
      supervisorId: filters.supervisorId || undefined,
      date: filters.date || undefined
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching performance reviews:', error);
    throw error;
  }
}

// Create performance review
export async function createPerformanceReview(payload) {
  try {
    const response = await apiClient.post('/performance', {
      staff_id: payload.staff_id,
      supervisor_id: payload.supervisor_id || null,
      location_id: payload.location_id || null,
      date: payload.date,
      category: payload.category,
      description: payload.description || '',
      photo_path: payload.photo_path || null,
      photo2_path: payload.photo2_path || null,
      photo3_path: payload.photo3_path || null,
      photo4_path: payload.photo4_path || null,
      pdf_path: payload.pdf_path || null
    });
    
    return {
      id: response.data.id,
      staff_id: payload.staff_id,
      supervisor_id: payload.supervisor_id,
      location_id: payload.location_id,
      date: response.data.date,
      category: response.data.category,
      description: response.data.description,
      photo_path: payload.photo_path,
      photo2_path: payload.photo2_path,
      photo3_path: payload.photo3_path,
      photo4_path: payload.photo4_path,
      created_at: response.data.created_at
    };
  } catch (error) {
    console.error('Error creating performance review:', error);
    throw error;
  }
}

// Delete performance review
export async function deletePerformanceReview(reviewId) {
  try {
    await apiClient.delete(`/performance/${reviewId}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting performance review:', error);
    throw error;
  }
}

// Generate PDF for performance review
// Note: PDF generation should be handled on backend. For now, this is a placeholder.
export async function generatePerformancePDF(reportId, reportData) {
  try {
    // TODO: Implement PDF generation endpoint on backend
    // For now, return null or handle on frontend
    console.warn('PDF generation not yet implemented on backend');
    return null;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

// Update performance review PDF path
export async function updatePerformanceReviewPDF(reportId, pdfPath) {
  try {
    const response = await apiClient.put(`/performance/${reportId}/pdf`, { pdfPath });
    return response.data;
  } catch (error) {
    console.error('Error updating PDF path:', error);
    throw error;
  }
}

