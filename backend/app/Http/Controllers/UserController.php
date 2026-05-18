<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query();
        
        if ($request->has('role')) {
            $query->where('role', $request->role);
        }
        
        if ($request->has('project')) {
            $query->where('project', $request->project);
        }
        
        $users = $query->get([
            'id', 'name', 'email', 'role', 'project', 
            'seller_name', 'full_name', 'is_active'
        ]);
        
        return response()->json([
            'success' => true,
            'data' => $users
        ]);
    }
    
    public function getSellers(Request $request)
    {
        $query = User::where('role', 'staff_a');
        
        if ($request->has('project')) {
            $query->where('project', $request->project);
        }
        
        $sellers = $query->get([
            'id', 'name', 'email', 'project', 
            'seller_name', 'full_name', 'is_active'
        ]);
        
        return response()->json([
            'success' => true,
            'data' => $sellers
        ]);
    }
    
    public function show($id)
    {
        $user = User::findOrFail($id);
        
        return response()->json([
            'success' => true,
            'data' => $user
        ]);
    }
}