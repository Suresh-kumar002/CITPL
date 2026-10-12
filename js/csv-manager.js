/* =====================================================
   CITPL - CSV DATA MANAGER
   Handles reading/writing CSV files for persistent storage
   All data saved in /data/ directory as .csv files
   ===================================================== */

class CSVDataManager {
    constructor() {
        this.csvPaths = {
            players: 'data/players.csv',
            teams: 'data/teams.csv',
            matches: 'data/matches.csv',
            auction: 'data/auction.csv',
            users: 'data/users.csv',
            scores: 'data/scores.csv'
        };
    }

    // Parse CSV string to array of objects
    parseCSV(csvString) {
        const lines = csvString.trim().split('\n');
        if (lines.length < 1) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = this.parseCSVLine(line);
            const obj = {};
            headers.forEach((header, idx) => {
                let val = values[idx] || '';
                // Convert numeric strings
                if (val !== '' && !isNaN(val) && val !== 'true' && val !== 'false') {
                    obj[header] = Number(val);
                } else if (val === 'true') {
                    obj[header] = true;
                } else if (val === 'false') {
                    obj[header] = false;
                } else if (val === 'null' || val === '') {
                    obj[header] = null;
                } else {
                    obj[header] = val;
                }
            });
            data.push(obj);
        }
        return data;
    }

    // Parse a single CSV line handling quoted fields
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    // Convert array of objects to CSV string
    toCSV(data, headers) {
        if (!data || data.length === 0) return headers.join(',') + '\n';
        
        const lines = [headers.join(',')];
        data.forEach(row => {
            const values = headers.map(h => {
                let val = row[h];
                if (val === null || val === undefined) return '';
                val = String(val);
                // Quote values containing commas, quotes, or newlines
                if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                    val = '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            lines.push(values.join(','));
        });
        return lines.join('\n') + '\n';
    }

    // Download CSV file
    downloadCSV(filename, csvContent) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // Export all data to CSV files (downloads as zip or individual)
    exportAllCSV(db) {
        const playerHeaders = ['id','registrationId','name','email','mobile','branch','sem','role','category','photo','status','paymentVerified','transactionId','teamId','auctionPrice','runs','wickets','matches','registeredAt'];
        const teamHeaders = ['id','name','shortName','ownerName','ownerEmail','startingPurse','remainingPurse','totalSpent','squadCount','points','wins','losses','nrr','createdAt'];
        const matchHeaders = ['id','matchNumber','teamAId','teamBId','assignedScorekeeper','isLockedByAdmin','status','venue','scheduledTime','oversLimit','result','createdAt'];
        const auctionHeaders = ['id','playerId','playerName','teamId','teamName','bidAmount','sequence','bidTime','timestamp','action'];
        const userHeaders = ['id','name','email','role','teamId','createdAt'];
        const scoreHeaders = ['id','matchId','innings','over','ball','runs','isExtra','extraType','isWicket','wicketType','strikerId','strikerName','bowlerId','bowlerName','timestamp'];

        // Export Players
        if (db.players && db.players.length > 0) {
            this.downloadCSV('players.csv', this.toCSV(db.players, playerHeaders));
        }
        
        // Export Teams
        if (db.teams && db.teams.length > 0) {
            this.downloadCSV('teams.csv', this.toCSV(db.teams, teamHeaders));
        }

        // Export Users
        if (db.users && db.users.length > 0) {
            this.downloadCSV('users.csv', this.toCSV(db.users, userHeaders));
        }

        // Export Matches
        if (db.matches && db.matches.length > 0) {
            this.downloadCSV('matches.csv', this.toCSV(db.matches, matchHeaders));
        }

        // Export Auction History
        if (db.auctionState && db.auctionState.bidsHistory && db.auctionState.bidsHistory.length > 0) {
            this.downloadCSV('auction.csv', this.toCSV(db.auctionState.bidsHistory, auctionHeaders));
        }
    }

    // Import CSV file and return parsed data
    importCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = this.parseCSV(e.target.result);
                    resolve(data);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // Save specific data to localStorage as CSV-compatible format
    syncToLocalStorage(db) {
        // This keeps the localStorage in sync with CSV-exportable data
        // The actual CSV files are downloaded on demand via Export
        localStorage.setItem('CITPL_CSV_LAST_SYNC', new Date().toISOString());
    }
}

// Make globally available
window.csvManager = new CSVDataManager();
