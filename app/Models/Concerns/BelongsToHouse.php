<?php

namespace App\Models\Concerns;

use App\Models\Scopes\HouseScope;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

/**
 * Isola os registros do model por usuário autenticado (cada usuário == uma casa).
 */
trait BelongsToHouse
{
    public static function bootBelongsToHouse(): void
    {
        static::addGlobalScope(new HouseScope);

        static::creating(function ($model) {
            if ($model->user_id === null && Auth::check()) {
                $model->user_id = Auth::id();
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
