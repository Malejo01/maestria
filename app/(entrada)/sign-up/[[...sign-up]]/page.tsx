// With Google OAuth there is no separate sign-up flow.
// Users are created automatically on first Google sign-in.
import { redirect } from 'next/navigation'

export default function SignUpPage() {
  redirect('/sign-in')
}

