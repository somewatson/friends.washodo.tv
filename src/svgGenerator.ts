import axios from 'axios';

export class SvgGenerator {
    /**
     * Generates an offline overlay SVG with an embedded profile picture.
     * @param profileImageUrl The URL of the user's profile picture.
     * @param username The username for the fallback label.
     */
    static async generateOfflineOverlay(profileImageUrl: string | null, username: string): Promise<string> {
        let imageB64 = '';
        
        if (profileImageUrl) {
            try {
                const response = await axios.get(profileImageUrl, { responseType: 'arraybuffer' });
                imageB64 = Buffer.from(response.data, 'binary').toString('base64');
            } catch (error) {
                console.error(`Error fetching profile image for ${username}:`, error);
                // Fallback to a generic placeholder if the fetch fails
                imageB64 = await this.getPlaceholderB64();
            }
        } else {
            imageB64 = await this.getPlaceholderB64();
        }

        return `
<svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="400" height="225" fill="#1f1f23" />
  
  <!-- Profile Image (Centered) -->
  <defs>
    <clipPath id="circleView">
      <circle cx="200" cy="100" r="60" />
    </clipPath>
  </defs>
  <image 
    href="data:image/png;base64,${imageB64}" 
    x="140" y="40" width="120" height="120" 
    clip-path="url(#circleView)" 
  />
  
  <!-- Offline Overlay Banner -->
  <rect x="0" y="160" width="400" height="65" fill="rgba(0,0,0,0.6)" />
  <text 
    x="200" y="195" 
    text-anchor="middle" 
    fill="#efeff1" 
    font-family="Arial, sans-serif" 
    font-size="24" 
    font-weight="bold" 
    style="text-transform: uppercase; letter-spacing: 2px;"
  >
    Offline
  </text>
  
  <!-- Subtle border -->
  <rect x="0" y="0" width="400" height="225" fill="none" stroke="#5a5a5e" stroke-width="4" />
</svg>`.trim();
    }

    private static async getPlaceholderB64(): Promise<string> {
        // Simple 1x1 transparent pixel as fallback, or could be a proper avatar
        return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1H9giAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    }
}
