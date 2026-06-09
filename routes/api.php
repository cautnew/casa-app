<?php

use App\Http\Controllers\Api\BillController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\ShoppingController;
use App\Http\Controllers\Api\StateController;
use Illuminate\Support\Facades\Route;

Route::get('/state', [StateController::class, 'index']);

Route::post('/members', [MemberController::class, 'store']);
Route::put('/members/{member}', [MemberController::class, 'update']);
Route::delete('/members/{member}', [MemberController::class, 'destroy']);

Route::post('/purchases', [PurchaseController::class, 'store']);
Route::put('/purchases/{purchase}', [PurchaseController::class, 'update']);
Route::delete('/purchases/{purchase}', [PurchaseController::class, 'destroy']);

Route::put('/inventory/{inventory}', [InventoryController::class, 'update']);
Route::patch('/inventory/{inventory}/qty', [InventoryController::class, 'updateQty']);
Route::patch('/inventory/{inventory}/toggle-next-list', [InventoryController::class, 'toggleNextList']);
Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy']);

Route::post('/shopping/finalize', [ShoppingController::class, 'finalize']);
Route::post('/shopping', [ShoppingController::class, 'store']);
Route::put('/shopping/{shopping}', [ShoppingController::class, 'update']);
Route::patch('/shopping/{shopping}/toggle-bought', [ShoppingController::class, 'toggleBought']);
Route::delete('/shopping/{shopping}', [ShoppingController::class, 'destroy']);

Route::post('/bills', [BillController::class, 'store']);
Route::put('/bills/{bill}', [BillController::class, 'update']);
Route::patch('/bills/{bill}/status', [BillController::class, 'setStatus']);
Route::delete('/bills/{bill}', [BillController::class, 'destroy']);
