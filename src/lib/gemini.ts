import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

const apiKey = process.env.GEMINI_API_KEY;
export const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export const PARSER_PROMPT = `
Extract financial transaction details from the following message. 
Categorize it into one of: Food, Shopping, Transport, Entertainment, Utilities, Rent, Salary, Investment, Loan Payment, Mutual Fund, Petrol, Restaurant, or Other.
Identify if it is a debit (expense) or credit (income).
Identify if it's an investment (e.g. Mutual Fund, Stocks, SIP).

If the message contains an account identifier like "HDFC Bank ending in 1234" or "SBI a/c 5678", extract "HDFC xxx1234" or similar masked format as 'accountIdentifier'.
Determine if the account is an 'asset' (bank accounts, credit balances, investments) or 'liability' (credit card bills, loan accounts) as 'accountType'.

Return JSON in this format:
{
  "amount": number,
  "type": "debit" | "credit",
  "category": string,
  "description": "ONLY the vendor or entity name (e.g., 'Zomato', 'Amazon', 'John Doe'). Do not include explanation",
  "availableBalance": number | null,
  "isInvestment": boolean,
  "isCreditCardBill": boolean,
  "dueDate": "YYYY-MM-DD" | null,
  "accountIdentifier": string | null,
  "accountType": "asset" | "liability" | null,
  "rejected": boolean,
  "reason": string | null
}

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
