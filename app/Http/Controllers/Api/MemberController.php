<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Member;
use Illuminate\Http\Request;

class MemberController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name'  => 'required|string|max:100',
            'color' => 'required|string|max:50',
        ]);

        $member = Member::create($data);

        return response()->json($member, 201);
    }

    public function update(Request $request, Member $member)
    {
        $data = $request->validate([
            'name'  => 'sometimes|string|max:100',
            'color' => 'sometimes|string|max:50',
        ]);

        $member->update($data);

        return response()->json($member);
    }

    public function destroy(Member $member)
    {
        $member->delete();

        return response()->noContent();
    }
}
