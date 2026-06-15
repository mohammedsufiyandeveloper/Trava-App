/**
 * Validates an email address, requiring a domain with a TLD.
 *
 * Note: a bare domain like "name@host" (no dot) is technically valid per RFC,
 * which is how typos such as "varun@thewhitetusker" (missing ".com") slip past
 * naive "@"-only checks. Requiring a dotted domain catches that common mistake.
 */
export function isValidEmail(email: string): boolean {
    const value = email.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
