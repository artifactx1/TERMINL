import { createCspReportHandler } from '../../lib/security/csp-report.mjs';

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

export default createCspReportHandler();
