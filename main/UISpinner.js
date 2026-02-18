/** UISpinner.js - CSS Spinner & Progress UI Module **/

/**
 * Shows a modeless dialog with a CSS spinner and status message
 * Auto-closes when the provided callback completes
 * 
 * Usage:
 *   showLoadingSpinner_('Rebuilding boards...');
 *   google.script.run
 *     .withSuccessHandler(() => hideLoadingSpinner_())
 *     .withFailureHandler((err) => {
 *       showSpinnerError_('Error: ' + err.message);
 *     })
 *     .someServerFunction();
 */
function showLoadingSpinner_(message) {
  try {
    const spinnerHtml = HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Google Sans', Arial, sans-serif;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background: #ffffff;
            }
            
            .spinner-container {
              text-align: center;
            }
            
            .spinner {
              border: 4px solid #f0f0f0;
              border-top: 4px solid #1a73e8;
              border-radius: 50%;
              width: 60px;
              height: 60px;
              animation: spin 0.8s linear infinite;
              margin: 0 auto 20px;
            }
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            .message {
              font-size: 16px;
              color: #202124;
              font-weight: 500;
              margin-bottom: 10px;
            }
            
            .status {
              font-size: 13px;
              color: #5f6368;
            }
            
            .progress-bar {
              width: 200px;
              height: 4px;
              background: #e0e0e0;
              border-radius: 2px;
              margin-top: 20px;
              overflow: hidden;
            }
            
            .progress-fill {
              height: 100%;
              background: linear-gradient(90deg, #1a73e8, #34a853);
              width: 30%;
              animation: expand 1s ease-in-out infinite;
            }
            
            @keyframes expand {
              0% { width: 30%; }
              50% { width: 90%; }
              100% { width: 30%; }
            }
            
            .error {
              color: #d33b27;
              font-weight: 500;
            }
            
            .success {
              color: #0d7a3c;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="spinner-container">
            <div class="spinner" id="spinner"></div>
            <div class="message" id="message">${message || 'Processing...'}</div>
            <div class="status" id="status">Please wait</div>
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
          </div>
          
          <script>
            window.updateSpinnerMessage = function(msg) {
              document.getElementById('message').textContent = msg;
            };
            
            window.showSpinnerError = function(error) {
              const messageEl = document.getElementById('message');
              messageEl.textContent = error;
              messageEl.className = 'message error';
              
              document.getElementById('spinner').style.display = 'none';
              document.getElementById('status').textContent = 'Error occurred';
              document.querySelector('.progress-bar').style.display = 'none';
              
              // Close after 3 seconds
              setTimeout(() => google.script.host.close(), 3000);
            };
            
            window.closeSpinner = function() {
              google.script.host.close();
            };
          </script>
        </body>
      </html>
    `);
    
    const ui = SpreadsheetApp.getUi();
    ui.modeless(spinnerHtml)
      .setWidth(280)
      .setHeight(250);
      
    Logger.log(`[UISpinner] Spinner shown: ${message}`);
  } catch (err) {
    Logger.log(`[UISpinner] Error showing spinner: ${err.message}`);
  }
}

/**
 * Hides the loading spinner
 * Safe to call even if spinner is not visible
 */
function hideLoadingSpinner_() {
  try {
    const ui = SpreadsheetApp.getUi();
    const modalDialog = ui.getActiveModelessDialog();
    if (modalDialog) {
      modalDialog.hide();
    } else {
      // Fallback: Try to close via script
      SpreadsheetApp.getUi().alert('');
    }
    Logger.log('[UISpinner] Spinner hidden');
  } catch (err) {
    Logger.log(`[UISpinner] Error hiding spinner: ${err.message}`);
  }
}

/**
 * Shows an error message in the spinner
 * Auto-closes after 3 seconds
 */
function showSpinnerError_(errorMessage) {
  try {
    const spinnerHtml = HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: 'Google Sans', Arial, sans-serif;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background: #fce8e6;
            }
            
            .error-container {
              text-align: center;
              padding: 30px;
              background: white;
              border-radius: 8px;
              border-left: 4px solid #d33b27;
              max-width: 300px;
            }
            
            .error-icon {
              font-size: 48px;
              margin-bottom: 15px;
            }
            
            .error-title {
              font-size: 16px;
              font-weight: 500;
              color: #d33b27;
              margin-bottom: 10px;
            }
            
            .error-message {
              font-size: 13px;
              color: #5f6368;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <div class="error-icon">⚠️</div>
            <div class="error-title">Error</div>
            <div class="error-message">${errorMessage}</div>
          </div>
          
          <script>
            setTimeout(() => google.script.host.close(), 3000);
          </script>
        </body>
      </html>
    `);
    
    const ui = SpreadsheetApp.getUi();
    ui.modeless(spinnerHtml)
      .setWidth(320)
      .setHeight(180);
      
    Logger.log(`[UISpinner] Error shown: ${errorMessage}`);
  } catch (err) {
    Logger.log(`[UISpinner] Error showing error: ${err.message}`);
  }
}

/**
 * Shows a success message
 * Auto-closes after 2 seconds
 */
function showSpinnerSuccess_(message) {
  try {
    const spinnerHtml = HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: 'Google Sans', Arial, sans-serif;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background: #e6f4ea;
            }
            
            .success-container {
              text-align: center;
              padding: 30px;
              background: white;
              border-radius: 8px;
              border-left: 4px solid #0d7a3c;
              max-width: 300px;
            }
            
            .success-icon {
              font-size: 48px;
              margin-bottom: 15px;
            }
            
            .success-title {
              font-size: 16px;
              font-weight: 500;
              color: #0d7a3c;
              margin-bottom: 10px;
            }
            
            .success-message {
              font-size: 13px;
              color: #5f6368;
            }
          </style>
        </head>
        <body>
          <div class="success-container">
            <div class="success-icon">✅</div>
            <div class="success-title">Success</div>
            <div class="success-message">${message}</div>
          </div>
          
          <script>
            setTimeout(() => google.script.host.close(), 2000);
          </script>
        </body>
      </html>
    `);
    
    const ui = SpreadsheetApp.getUi();
    ui.modeless(spinnerHtml)
      .setWidth(320)
      .setHeight(160);
      
    Logger.log(`[UISpinner] Success shown: ${message}`);
  } catch (err) {
    Logger.log(`[UISpinner] Error showing success: ${err.message}`);
  }
}
