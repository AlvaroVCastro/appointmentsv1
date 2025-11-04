// Import package.json for app metadata
import packageJson from '../../package.json';

export const appConfig = {
  name: packageJson.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  description: packageJson.description,
  version: packageJson.version,
  author: packageJson.author,
  logos: packageJson.logos,
  favicon: packageJson.favicon,
  features: packageJson.features,
}; 