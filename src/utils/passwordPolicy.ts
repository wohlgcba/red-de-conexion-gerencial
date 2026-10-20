export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_PATTERN = '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}'
export const PASSWORD_REQUIREMENTS = 'Al menos 8 caracteres, con una mayúscula, una minúscula y un número.'

// Keep identical to Supabase's lower_upper_letters_digits character sets.
export function validPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password)
}
