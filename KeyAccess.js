/* KeyAccess.js
   Minimal helper to obtain an OAuth2 access token for Google Cloud APIs
   using Google Identity Services (token client).

   Usage:
     KeyAccess.configure({ clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com', scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
     await KeyAccess.requestAccess(); // prompts user for consent
     const token = KeyAccess.getAccessToken();
     const res = await KeyAccess.callApi('https://www.googleapis.com/someapi', { method: 'GET' });

   Replace CLIENT_ID with your OAuth 2.0 Client ID from Google Cloud Console.
*/

(function(window){
    const KeyAccess = {};

    let _clientId = null;
    let _scopes = [];
    let _tokenClient = null;
    let _accessToken = null;

    function loadScript(src){
        return new Promise((resolve, reject)=>{
            if(document.querySelector(`script[src="${src}"]`)) return resolve();
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = (e)=> reject(e);
            document.head.appendChild(s);
        });
    }

    async function ensureGis(){
        if(window.google && window.google.accounts && window.google.accounts.oauth2) return;
        await loadScript('https://accounts.google.com/gsi/client');
    }

    KeyAccess.configure = function({ clientId, scopes }){
        _clientId = clientId;
        _scopes = Array.isArray(scopes) ? scopes : (scopes ? [scopes] : []);
    };

    KeyAccess.requestAccess = async function(promptConsent = true){
        if(!_clientId) throw new Error('KeyAccess: clientId not configured. Call KeyAccess.configure()');

        await ensureGis();

        _tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: _clientId,
            scope: _scopes.join(' '),
            callback: (resp) => {
                if(resp && resp.error){
                    console.error('KeyAccess token error', resp);
                } else {
                    _accessToken = resp.access_token;
                    if(typeof KeyAccess.onAuth === 'function') KeyAccess.onAuth(_accessToken);
                }
            }
        });

        // request token (may prompt consent UI)
        _tokenClient.requestAccessToken({ prompt: promptConsent ? 'consent' : undefined });

        // wait until token is available
        return new Promise((resolve, reject)=>{
            const t0 = Date.now();
            const iv = setInterval(()=>{
                if(_accessToken){ clearInterval(iv); resolve(_accessToken); }
                if(Date.now() - t0 > 120000){ clearInterval(iv); reject(new Error('KeyAccess: timeout obtaining token')); }
            }, 200);
        });
    };

    KeyAccess.getAccessToken = function(){
        return _accessToken;
    };

    KeyAccess.callApi = async function(url, opts = {}){
        if(!_accessToken) throw new Error('KeyAccess: no access token. Call requestAccess() first.');
        opts.headers = opts.headers || {};
        opts.headers['Authorization'] = 'Bearer ' + _accessToken;
        return fetch(url, opts);
    };

    // Optional callback hook: KeyAccess.onAuth = (token)=>{ /* ... */ }
    KeyAccess.onAuth = null;

    window.KeyAccess = KeyAccess;
})(window);
