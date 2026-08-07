<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const PASSWORD_RULE = ['required', 'string', 'regex:/^\d{6}$/'];
    private const PASSWORD_RULE_OPTIONAL = ['nullable', 'string', 'regex:/^\d{6}$/'];
    private const PASSWORD_MESSAGE = 'A senha deve ter exatamente 6 dígitos numéricos.';

    private const USERNAME_RULE = ['required', 'string', 'max:50', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'];
    private const USERNAME_MESSAGE = 'O nome de usuário deve ser um slug (letras minúsculas, números e hífens).';

    public function register(Request $request)
    {
        $payload = $request->all();
        $payload['username'] = Str::slug($payload['username'] ?? '');

        $data = Validator::make($payload, [
            'name' => 'required|string|max:100',
            'username' => [...self::USERNAME_RULE, 'unique:users,username'],
            'email' => 'required|email|max:150|unique:users,email',
            'password' => self::PASSWORD_RULE,
        ], [
            'password.regex' => self::PASSWORD_MESSAGE,
            'username.regex' => self::USERNAME_MESSAGE,
        ])->validate();

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

    public function update(Request $request)
    {
        $user = $request->user();

        $payload = $request->all();
        $payload['username'] = Str::slug($payload['username'] ?? '');

        $data = Validator::make($payload, [
            'name' => 'required|string|max:100',
            'username' => [...self::USERNAME_RULE, 'unique:users,username,'.$user->id],
            'email' => 'required|email|max:150|unique:users,email,'.$user->id,
            'password' => self::PASSWORD_RULE_OPTIONAL,
        ], [
            'password.regex' => self::PASSWORD_MESSAGE,
            'username.regex' => self::USERNAME_MESSAGE,
        ])->validate();

        $user->fill([
            'name' => $data['name'],
            'username' => $data['username'],
            'email' => $data['email'],
        ]);

        if (! empty($data['password'])) {
            $user->password = $data['password'];
        }

        $user->save();

        return response()->json($this->present($user));
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
