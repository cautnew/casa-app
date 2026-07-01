<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const PASSWORD_RULE = ['required', 'string', 'regex:/^\d{6}$/'];
    private const PASSWORD_MESSAGE = 'A senha deve ter exatamente 6 dígitos numéricos.';

    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'username' => 'required|string|alpha_dash|max:50|unique:users,username',
            'email' => 'required|email|max:150|unique:users,email',
            'password' => self::PASSWORD_RULE,
        ], [
            'password.regex' => self::PASSWORD_MESSAGE,
        ]);

        $user = User::create($data);

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json($this->present($user), 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'login' => 'required|string',
            'password' => self::PASSWORD_RULE,
        ], [
            'password.regex' => self::PASSWORD_MESSAGE,
        ]);

        $field = filter_var($data['login'], FILTER_VALIDATE_EMAIL) ? 'email' : 'username';

        if (! Auth::attempt([$field => $data['login'], 'password' => $data['password']])) {
            throw ValidationException::withMessages([
                'login' => 'Usuário/e-mail ou senha inválidos.',
            ]);
        }

        $request->session()->regenerate();

        return response()->json($this->present(Auth::user()));
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function me(Request $request)
    {
        return response()->json($this->present($request->user()));
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
        ];
    }
}
