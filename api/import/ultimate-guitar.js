import {handleUgImport} from '../../server/ug-import.js';

// Vercel's Node.js Web handler uses the same bounded importer as the Worker.
export default {fetch:handleUgImport};
