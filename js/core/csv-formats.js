// CSV Format Definitions
// Defines mapping configurations for different CSV formats

export const CSV_FORMATS = {
    'capital-one-checking': {
        name: 'Capital One Checking/Savings',
        description: 'Account Number, Transaction Description, Transaction Date, Transaction Type, Transaction Amount, Balance',
        mapper: (normalizedRow) => {
            const accountNumber = normalizedRow['account number'] || 
                                 normalizedRow['account_number'] || 
                                 normalizedRow['account'] || '';
            
            const description = normalizedRow['transaction description'] || 
                               normalizedRow['description'] || 
                               normalizedRow['desc'] || '';
            
            const date = normalizedRow['transaction date'] || 
                        normalizedRow['date'] || 
                        normalizedRow['trans date'] || '';
            
            const transactionType = normalizedRow['transaction type'] || 
                                   normalizedRow['type'] || 
                                   normalizedRow['trans type'] || '';
            
            let amount = parseFloat(normalizedRow['transaction amount'] || 
                                   normalizedRow['amount'] || 
                                   normalizedRow['trans amount'] || '0');
            
            // Make negative for debit, positive for credit
            if (transactionType.toLowerCase().includes('debit')) {
                amount = -Math.abs(amount);
            } else if (transactionType.toLowerCase().includes('credit')) {
                amount = Math.abs(amount);
            }
            
            return {
                accountNumber,
                description,
                date,
                transactionType,
                amount
            };
        }
    },
    
    'capital-one-credit': {
        name: 'Capital One Credit',
        description: 'Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit',
        mapper: (normalizedRow) => {
            // Transaction Date maps to our date
            const date = normalizedRow['transaction date'] || 
                        normalizedRow['trans date'] || 
                        normalizedRow['date'] || '';
            
            // Card No. maps to our account number
            const accountNumber = normalizedRow['card no.'] || 
                                 normalizedRow['card no'] || 
                                 normalizedRow['card number'] || 
                                 normalizedRow['card'] || '';
            
            // Description maps directly
            const description = normalizedRow['description'] || 
                               normalizedRow['desc'] || '';
            
            // Combine debit and credit columns
            // Debit should be negative, credit should be positive
            const debit = parseFloat(normalizedRow['debit'] || '0');
            const credit = parseFloat(normalizedRow['credit'] || '0');
            
            let amount = 0;
            if (debit !== 0) {
                amount = -Math.abs(debit); // Debit is negative
            } else if (credit !== 0) {
                amount = Math.abs(credit); // Credit is positive
            }
            
            return {
                accountNumber,
                description,
                date,
                transactionType: debit !== 0 ? 'Debit' : 'Credit', // For consistency
                amount
            };
        }
    }
};

export function getFormatList() {
    return Object.keys(CSV_FORMATS).map(key => ({
        id: key,
        name: CSV_FORMATS[key].name,
        description: CSV_FORMATS[key].description
    }));
}

export function getFormatMapper(formatId) {
    const format = CSV_FORMATS[formatId];
    if (!format) {
        throw new Error(`Unknown CSV format: ${formatId}`);
    }
    return format.mapper;
}
