import { Transaction } from "../types";

export const PARSER_PROMPT = `
Extract financial transaction details from the following message. 
Categorize it into one of: Food, Shopping, Transport, Entertainment, Utilities, Rent, Salary, Investment, Loan Payment, Mutual Fund, Petrol, Restaurant, or Other.
Identify if it is a debit (expense) or credit (income).
Identify if it's an investment (e.g. Mutual Fund, Stocks, SIP).

If the message contains an account identifier like "HDFC Bank ending in 1234" or "SBI a/c 5678", extract ONLY the last 4 digits prefixed with "XXXX" (e.g., "XXXX1234") as 'accountIdentifier'. Do not include the bank name.
Determine if the account is an 'asset' (bank accounts, credit balances, investments) or 'liability' (credit card bills, loan accounts) as 'accountType'.

Return JSON in this format:
{
  "amount": number,
  "type": "debit" | "credit",
  "category": string,
  "description": "Cleaned vendor or entity name along with the payment method used if available (e.g., 'UPI - Zomato', 'IMPS - John Doe', 'Amazon'). Do not include further explanation",
  "availableBalance": number | null,
  "isInvestment": boolean,
  "isCreditCardBill": boolean,
  "dueDate": "YYYY-MM-DD" | null,
  "transactionDate": "YYYY-MM-DD" | null,
  "accountIdentifier": string | null,
  "accountName": string | null,
  "accountType": "asset" | "liability" | null,
  "rejected": boolean,
  "reason": string | null
}

IMPORTANT EXTRACT RULES:
- "accountName": Extract the raw name of the account/bank (e.g. "HDFC Bank", "SBI", "CRED") if mentioned.
- "transactionDate": Extract the transaction date if present in YYYY-MM-DD format (assume current year if unspecified). If no date is given, return null.

IMPORTANT REJECTION RULES:
If the message contains an OTP, verification code, or comes from a 10-digit mobile number, or is a promotional/government message (e.g., sender ends with -P, -G like AD-HDFCBK-P), set "rejected": true and provide a "reason".
If it is a personal message without transaction details, set "rejected": true.
Otherwise setting "rejected": false.
`;

export const getParserPromptWithContext = (recentTransactions: Transaction[]) => {
  const contextList = recentTransactions.slice(0, 10).map((t) => 
    `{ description: "${t.description}", category: "${t.category}" }`
  ).join('\n');

  return `
${PARSER_PROMPT}

Here is context of how the user usually categorizes based on description:
${contextList}

Please use this history to adapt your categorization. Specifically, if you see a similar merchant or description, use the category from the context.
  `;
};
