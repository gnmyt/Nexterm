const stripAnsi = (text) => {
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
};

const PROGRESS_PATTERNS = [
    {
        regex: /^\s*(\d+)%\s+\[/,
        extract: (match) => parseInt(match[1], 10),
        priority: 100
    },
    {
        regex: /(\d+)\s*(?:\/|of)\s*(\d+).*?(\d+)%/i,
        extract: (match) => parseInt(match[3], 10),
        priority: 90
    },
    {
        regex: /\[\+\]\s+Running\s+(\d+)\/(\d+)/i,
        extract: (match) => {
            const current = parseInt(match[1], 10);
            const total = parseInt(match[2], 10);
            if (total === 0) return null;
            return Math.min(100, Math.round((current / total) * 100));
        },
        priority: 85
    },
    {
        regex: /\[[\u2800-\u28FF⣿⣷⣶⣦⣤⣄⣀\s=>#\-_.]+\]\s*(\d+(?:\.\d+)?)\s*([KMGT]?B)\s*[/:]\s*(\d+(?:\.\d+)?)\s*([KMGT]?B)/i,
        extract: (match) => {
            const current = parseFloat(match[1]);
            const currentUnit = match[2];
            const total = parseFloat(match[3]);
            const totalUnit = match[4];
            
            const units = { 'B': 1, 'KB': 1024, 'MB': 1024*1024, 'GB': 1024*1024*1024, 'TB': 1024*1024*1024*1024 };
            const currentBytes = current * (units[currentUnit] || 1);
            const totalBytes = total * (units[totalUnit] || 1);
            
            if (totalBytes === 0) return null;
            return Math.min(100, Math.round((currentBytes / totalBytes) * 100));
        },
        priority: 80
    },
    {
        regex: /(?:^|\s)(\d+)\s*(?:\/|of)\s*(\d+)(?:\s|$)/i,
        extract: (match) => {
            const current = parseInt(match[1], 10);
            const total = parseInt(match[2], 10);
            if (total === 0 || total > 10000) return null;
            return Math.min(100, Math.round((current / total) * 100));
        },
        priority: 40
    },
    {
        regex: /(\d+(?:\.\d+)?)\s*([KMGT]?B)\s*[/:]\s*(\d+(?:\.\d+)?)\s*([KMGT]?B)/i,
        extract: (match) => {
            const current = parseFloat(match[1]);
            const currentUnit = match[2];
            const total = parseFloat(match[3]);
            const totalUnit = match[4];
            
            const units = { 'B': 1, 'KB': 1024, 'MB': 1024*1024, 'GB': 1024*1024*1024, 'TB': 1024*1024*1024*1024 };
            const currentBytes = current * (units[currentUnit] || 1);
            const totalBytes = total * (units[totalUnit] || 1);
            
            if (totalBytes === 0) return null;
            return Math.min(100, Math.round((currentBytes / totalBytes) * 100));
        },
        priority: 50
    },
    {
        regex: /(?:downloading|extracting|pushing|pulling|installing|loading|uploading|copying|transferring|processing|building|compiling).*?(\d+)%/i,
        extract: (match) => parseInt(match[1], 10),
        priority: 60
    },
    {
        regex: /(?:Reading package lists|Building dependency tree|Reading state information|Installing|Unpacking|Setting up|Processing triggers).*?(\d+)%/i,
        extract: (match) => parseInt(match[1], 10),
        priority: 70
    },
    {
        regex: /(?:Reading package lists|Building dependency tree|Reading state information).*?Done/i,
        extract: () => 100,
        priority: 75
    },
    {
        regex: /[\[\(]\s*(\d+)%\s*[\]\)]/,
        extract: (match) => parseInt(match[1], 10),
        priority: 45
    },
    {
        regex: /[\[|\(][\s=>#\-_.]+[\]|\)]\s*(\d+)%/i,
        extract: (match) => parseInt(match[1], 10),
        priority: 55
    },
    {
        regex: /(\d+)%\s*[\[|\(][\s=>#\-_.]+[\]|\)]/,
        extract: (match) => parseInt(match[1], 10),
        priority: 55
    },
    {
        regex: /(?:Receiving|Counting|Compressing|Resolving)\s+(?:objects|deltas):\s*(\d+)%/i,
        extract: (match) => parseInt(match[1], 10),
        priority: 65
    },
    {
        regex: /[━─▬═▓▒░■◼◾▪⬛]+\s*(\d+)%/,
        extract: (match) => parseInt(match[1], 10),
        priority: 58
    },
    {
        regex: /(?:^|\s)(\d{1,3})%(?:\s|$|:)/,
        extract: (match) => {
            const percent = parseInt(match[1], 10);
            return (percent >= 0 && percent <= 100) ? percent : null;
        },
        priority: 30
    }
];

const COMPLETION_PATTERNS = [
    /(?:Done|Complete|Finished|Success)\.?$/i,
    /Successfully\s+(?:installed|updated|downloaded|completed|finished)/i,
    /100%.*(?:done|complete|finished)/i,
    /(?:Installation|Download|Update|Upgrade|Build)\s+complete/i,
    /packages can be (?:upgraded|installed)/i,
    /^\d+\s+(?:upgraded|newly installed|to remove|not upgraded)/i,
    /Pull complete/i,
    /✔.*(?:Pull complete|Already exists|Download complete|Done)/i,
    /Container.*(?:started|running|created)/i,
    /All\s+(?:done|complete|finished)/i,
    /(?:Process|Task|Operation)\s+(?:completed|finished)/i,
    /\[(?:OK|DONE|COMPLETE)\]/i,
    /Status:\s*(?:Complete|Done|Finished|Success)/i
];

export class TerminalProgressParser {
    constructor() {
        this.currentProgress = 0;
        this.lastProgressTime = Date.now();
        this.progressTimeout = null;
        this.completionTimeout = null;
        this.isTracking = false;
        this.inactivityThreshold = 3000;
        this.completionDelay = 500;
    }

    parseLine(rawLine) {
        const line = stripAnsi(rawLine);
        
        for (const pattern of COMPLETION_PATTERNS) {
            if (pattern.test(line)) {
                this.isTracking = false;
                this.currentProgress = 100;
                
                if (this.progressTimeout) {
                    clearTimeout(this.progressTimeout);
                    this.progressTimeout = null;
                }
                
                if (this.completionTimeout) {
                    clearTimeout(this.completionTimeout);
                }
                this.completionTimeout = setTimeout(() => {
                    this.reset();
                }, this.completionDelay);
                
                return 100;
            }
        }
        
        const sortedPatterns = [...PROGRESS_PATTERNS].sort((a, b) => 
            (b.priority || 0) - (a.priority || 0)
        );
        
        for (const pattern of sortedPatterns) {
            const match = line.match(pattern.regex);
            if (match) {
                const progress = pattern.extract(match);
                
                if (progress !== null && progress >= 0 && progress <= 100) {
                    this.isTracking = true;
                    this.currentProgress = progress;
                    this.lastProgressTime = Date.now();
                    
                    if (this.progressTimeout) {
                        clearTimeout(this.progressTimeout);
                    }
                    
                    this.progressTimeout = setTimeout(() => {
                        this.reset();
                    }, this.inactivityThreshold);
                    
                    return progress;
                }
            }
        }
        
        if (this.isTracking && Date.now() - this.lastProgressTime > this.inactivityThreshold) {
            this.reset();
        }
        
        return null;
    }

    parseData(data) {
        const lines = data.split(/\r?\n/);
        let latestProgress = null;
        
        for (const line of lines) {
            const progress = this.parseLine(line);
            if (progress !== null) {
                latestProgress = progress;
            }
        }
        
        return latestProgress;
    }

    getProgress() {
        return this.currentProgress;
    }

    isTrackingProgress() {
        return this.isTracking;
    }

    reset() {
        this.currentProgress = 0;
        this.isTracking = false;
        if (this.progressTimeout) {
            clearTimeout(this.progressTimeout);
            this.progressTimeout = null;
        }
        if (this.completionTimeout) {
            clearTimeout(this.completionTimeout);
            this.completionTimeout = null;
        }
    }

    destroy() {
        this.reset();
    }
}

export const createProgressParser = () => {
    return new TerminalProgressParser();
};
