import apiClient from './apiClient';
import { PARSE_CLASSES } from './apiClient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

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
    // Build query params, only include defined values
    const params = {};
    if (filters.staffId) params.staffId = filters.staffId;
    if (filters.supervisorId) params.supervisorId = filters.supervisorId;
    if (filters.date) params.date = filters.date;
    
    const response = await apiClient.get('/performance', params);
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
export async function generatePerformancePDF(reportId, reportData) {
  try {
    const categoryLabel = reportData.category 
      ? reportData.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      : 'N/A';
    
    // Format date nicely
    const reportDate = reportData.date ? new Date(reportData.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'N/A';
    
    const generatedDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Build photo HTML if photos exist
    let photosHtml = '';
    const photos = [
      reportData.photo_path,
      reportData.photo2_path,
      reportData.photo3_path,
      reportData.photo4_path
    ].filter(p => p);
    
    if (photos.length > 0) {
      photosHtml = `
        <div class="section photos-section">
          <div class="section-header">
            <div class="section-icon">📷</div>
            <h3>Documentary Evidence</h3>
          </div>
          <div class="photos-grid">
            ${photos.map((photo, index) => `
              <div class="photo-container">
                <img src="${photo}" alt="Evidence ${index + 1}" />
                <div class="photo-label">Evidence ${index + 1}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Performance Review Report - ${reportData.staff_name || 'Staff'}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #2c3e50;
            line-height: 1.6;
            background: #fff;
          }
          
          /* Header */
          .header {
            background: linear-gradient(135deg, #1a5276 0%, #2980b9 100%);
            color: white;
            padding: 25px 30px;
            margin: -15mm -15mm 0 -15mm;
            text-align: center;
            position: relative;
          }
          .header::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #f39c12, #e74c3c, #9b59b6, #3498db);
          }
          .logo-area {
            margin-bottom: 10px;
          }
          .logo-text {
            font-size: 14px;
            letter-spacing: 3px;
            opacity: 0.9;
            margin-bottom: 5px;
          }
          .company-name {
            font-size: 26px;
            font-weight: 700;
            letter-spacing: 1px;
            margin-bottom: 5px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
          }
          .company-location {
            font-size: 14px;
            opacity: 0.9;
            letter-spacing: 2px;
          }
          .report-title {
            background: rgba(255,255,255,0.15);
            display: inline-block;
            padding: 8px 30px;
            border-radius: 25px;
            margin-top: 15px;
            font-size: 16px;
            font-weight: 600;
            letter-spacing: 1px;
          }
          
          /* Document Info Bar */
          .doc-info-bar {
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #6c757d;
            margin: 0 -15mm;
            padding-left: 30px;
            padding-right: 30px;
          }
          .doc-info-bar span {
            display: flex;
            align-items: center;
            gap: 5px;
          }
          
          /* Content */
          .content {
            padding: 25px 0;
          }
          
          /* Section Styling */
          .section {
            margin-bottom: 25px;
            background: #fff;
            border-radius: 10px;
            border: 1px solid #e9ecef;
            overflow: hidden;
          }
          .section-header {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 12px 20px;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .section-icon {
            font-size: 18px;
          }
          .section-header h3 {
            font-size: 14px;
            font-weight: 600;
            color: #1a5276;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .section-content {
            padding: 20px;
          }
          
          /* Info Grid */
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0;
          }
          .info-item {
            padding: 15px 20px;
            border-bottom: 1px solid #f1f3f4;
            display: flex;
            flex-direction: column;
          }
          .info-item:nth-child(odd) {
            border-right: 1px solid #f1f3f4;
          }
          .info-item:nth-last-child(-n+2) {
            border-bottom: none;
          }
          .info-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #7f8c8d;
            margin-bottom: 5px;
            font-weight: 600;
          }
          .info-value {
            font-size: 15px;
            color: #2c3e50;
            font-weight: 500;
          }
          .info-value.highlight {
            color: #1a5276;
            font-weight: 600;
          }
          
          /* Category Badge */
          .category-badge {
            display: inline-block;
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            padding: 6px 15px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 500;
          }
          
          /* Description */
          .description-content {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            font-size: 14px;
            line-height: 1.8;
            color: #34495e;
            border-left: 4px solid #3498db;
            min-height: 80px;
          }
          .description-content.empty {
            color: #95a5a6;
            font-style: italic;
          }
          
          /* Photos */
          .photos-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            padding: 20px;
          }
          .photo-container {
            text-align: center;
            background: #f8f9fa;
            border-radius: 8px;
            padding: 10px;
            border: 1px solid #e9ecef;
          }
          .photo-container img {
            max-width: 100%;
            max-height: 200px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .photo-label {
            margin-top: 8px;
            font-size: 11px;
            color: #7f8c8d;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          /* Footer */
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e9ecef;
          }
          .footer-content {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .signature-box {
            width: 200px;
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #2c3e50;
            margin-top: 50px;
            padding-top: 8px;
            font-size: 12px;
            color: #7f8c8d;
          }
          .qr-placeholder {
            text-align: right;
            color: #bdc3c7;
            font-size: 11px;
          }
          .footer-bottom {
            margin-top: 20px;
            text-align: center;
            font-size: 10px;
            color: #95a5a6;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .footer-bottom p {
            margin: 3px 0;
          }
          .confidential {
            color: #e74c3c;
            font-weight: 600;
            letter-spacing: 1px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-area">
            <div class="logo-text">GOVERNMENT OF KHYBER PAKHTUNKHWA</div>
            <div class="company-name">WATER & SANITATION SERVICES COMPANY</div>
            <div class="company-location">MINGORA, SWAT</div>
          </div>
          <div class="report-title">📋 PERFORMANCE REVIEW REPORT</div>
        </div>
        
        <div class="doc-info-bar">
          <span>📄 Document ID: PRR-${reportId.toString().slice(-8).toUpperCase()}</span>
          <span>📅 Generated: ${generatedDate}</span>
        </div>
        
        <div class="content">
          <!-- Report Information -->
          <div class="section">
            <div class="section-header">
              <div class="section-icon">📋</div>
              <h3>Report Information</h3>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Report Date</span>
                <span class="info-value highlight">${reportDate}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Category</span>
                <span class="info-value"><span class="category-badge">${categoryLabel}</span></span>
              </div>
              <div class="info-item">
                <span class="info-label">Location / Area</span>
                <span class="info-value">${reportData.location_name || 'Not Specified'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Status</span>
                <span class="info-value highlight">✓ Submitted</span>
              </div>
            </div>
          </div>
          
          <!-- Personnel Details -->
          <div class="section">
            <div class="section-header">
              <div class="section-icon">👥</div>
              <h3>Personnel Details</h3>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Report Submitted By</span>
                <span class="info-value highlight">${reportData.supervisor_name || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Designation</span>
                <span class="info-value">Supervisor</span>
              </div>
              <div class="info-item">
                <span class="info-label">Worker Under Review</span>
                <span class="info-value">${reportData.staff_name || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Assignment Location</span>
                <span class="info-value">${reportData.location_name || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          <!-- Description -->
          <div class="section">
            <div class="section-header">
              <div class="section-icon">📝</div>
              <h3>Supervisor's Observation & Remarks</h3>
            </div>
            <div class="section-content">
              <div class="description-content ${!reportData.description ? 'empty' : ''}">
                ${reportData.description || 'No observations or remarks were recorded by the supervisor.'}
              </div>
            </div>
          </div>
          
          ${photosHtml}
          
          <!-- Footer -->
          <div class="footer">
            <div class="footer-content">
              <div class="signature-box">
                <div class="signature-line">Submitted By (Supervisor)</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">Verified By (Manager)</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">Approved By (GM)</div>
              </div>
            </div>
            <div class="footer-bottom">
              <p class="confidential">⚠️ INTERNAL DOCUMENT - FOR OFFICIAL USE ONLY</p>
              <p>Water & Sanitation Services Company, MSK Tower, G.T Road, Rahimabad, Mingora, Swat</p>
              <p>This is a computer-generated document. Report ID: ${reportId}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      // For web, we'll create and download the PDF directly
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      }
      return null; // Web doesn't return a file path
    } else {
      // For mobile, use expo-print to generate PDF
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      
      return uri;
    }
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

