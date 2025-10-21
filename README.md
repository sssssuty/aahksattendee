# Youlify Scoreboard

A minimalist, dark mode scoreboard website for tracking total knee surgery providers.

## Features

- **Homepage**: Displays top 10 providers by total knee surgery volume
- **Provider Search**: Find your ranking among all providers
- **State Rankings**: Click on states to see regional top 10 providers
- **Dark Mode**: Minimalist grayscale design
- **Responsive**: Works on desktop and mobile devices

## How to Use

### Option 1: Direct File Opening (Recommended)
Simply double-click on `index.html` to open it in your default web browser. The website will work completely offline.

### Option 2: Local Server (Alternative)
If you prefer using a local server, you can use any of these methods:

**Python:**
```bash
python3 -m http.server 8000
```

**Node.js:**
```bash
npx serve .
```

**PHP:**
```bash
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## File Structure

- `index.html` - Homepage with top 10 providers
- `provider.html` - Provider search page
- `state.html` - Interactive state map
- `styles.css` - Minimalist dark mode styling
- `script.js` - JavaScript functionality
- `data.js` - Embedded CMS data (no external dependencies)
- `aahkscms_data_output.json` - Original CMS data source (not used by website)

## Technical Details

- **Pure HTML/CSS/JavaScript** - No frameworks or dependencies
- **Data Source**: Filters CMS data for HCPCS_Cd "27447" (total knee surgery)
- **Responsive Design**: Works on all screen sizes
- **Dark Theme**: Minimalist grayscale color scheme
- **Offline Capable**: Works without internet connection

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers

## Data Processing

The website automatically:
1. Loads and processes the JSON data
2. Filters for total knee surgery procedures (HCPCS_Cd: "27447")
3. Aggregates data by provider name
4. Sorts by total services performed
5. Handles case-insensitive name matching for searches
